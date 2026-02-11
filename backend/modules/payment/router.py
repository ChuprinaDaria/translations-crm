"""
Payment routes - Stripe and Przelewy24 integration.
"""
import json
import logging
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from core.database import get_db
from core.rbac import Scope, get_user_scopes
from modules.auth.dependencies import get_current_user_db, role_required
from modules.auth.models import UserRole
import models

from modules.payment.models import (
    PaymentSettings,
    PaymentTransaction,
    PaymentLink,
    PaymentProvider,
    PaymentStatus,
)
from modules.payment.schemas import (
    PaymentSettingsCreate,
    PaymentSettingsUpdate,
    PaymentSettingsRead,
    PaymentSettingsReadSecure,
    PaymentTransactionCreate,
    PaymentTransactionRead,
    PaymentLinkCreate,
    PaymentLinkRead,
    PaymentMethodsResponse,
    PaymentStatsResponse,
    P24NotificationWebhook,
    P24TransactionRegisterRequest,
)
from modules.payment.services.stripe_service import StripeService
from modules.payment.services.przelewy24_service import Przelewy24Service
from modules.crm.models import Order
from modules.finance.models import Transaction as FinanceTransaction, PaymentMethod

logger = logging.getLogger(__name__)

router = APIRouter(tags=["payment"], prefix="/payment")


# Helper functions
def get_payment_settings(db: Session) -> Optional[PaymentSettings]:
    """Get payment settings (should be singleton)."""
    return db.query(PaymentSettings).first()


def get_or_create_settings(db: Session) -> PaymentSettings:
    """Get or create payment settings."""
    settings = get_payment_settings(db)
    if not settings:
        settings = PaymentSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


# Settings endpoints
@router.get("/settings", response_model=PaymentSettingsRead)
def get_settings(
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT])),
):
    """
    Get payment settings.
    Sensitive data hidden for non-owner users.
    """
    settings = get_or_create_settings(db)
    
    # Return secure data only for owner
    if user.role == UserRole.OWNER:
        return PaymentSettingsReadSecure.model_validate(settings)
    else:
        # Hide sensitive keys for non-owners
        return PaymentSettingsRead.model_validate(settings)


@router.put("/settings", response_model=PaymentSettingsRead)
def update_settings(
    settings_update: PaymentSettingsUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER])),
):
    """
    Update payment settings.
    Only owner can update.
    """
    settings = get_or_create_settings(db)
    
    # Update fields
    update_data = settings_update.model_dump(exclude_unset=True)
    
    # Валідація: якщо встановлюється active_payment_provider, перевірити чи система налаштована
    if "active_payment_provider" in update_data:
        active_provider = update_data["active_payment_provider"]
        if active_provider == PaymentProvider.STRIPE:
            if not settings.stripe_enabled or not settings.stripe_secret_key:
                raise HTTPException(
                    status_code=400,
                    detail="Stripe is not enabled or not configured. Please enable and configure Stripe first."
                )
        elif active_provider == PaymentProvider.PRZELEWY24:
            if not settings.przelewy24_enabled or not settings.przelewy24_merchant_id:
                raise HTTPException(
                    status_code=400,
                    detail="Przelewy24 is not enabled or not configured. Please enable and configure Przelewy24 first."
                )
    
    for field, value in update_data.items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return PaymentSettingsReadSecure.model_validate(settings)


@router.post("/settings/test-connection")
async def test_payment_connection(
    provider: PaymentProvider,
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER])),
):
    """
    Test payment provider connection.
    """
    settings = get_or_create_settings(db)
    
    try:
        if provider == PaymentProvider.STRIPE:
            if not settings.stripe_enabled:
                raise HTTPException(status_code=400, detail="Stripe not enabled")
            
            service = StripeService(settings)
            is_connected = await service.test_connection()
            
        elif provider == PaymentProvider.PRZELEWY24:
            if not settings.przelewy24_enabled:
                raise HTTPException(status_code=400, detail="Przelewy24 not enabled")
            
            service = Przelewy24Service(settings)
            is_connected = await service.test_connection()
        else:
            raise HTTPException(status_code=400, detail="Invalid provider")
        
        return {"success": is_connected, "provider": provider}
    
    except Exception as e:
        logger.error(f"Connection test failed for {provider}: {e}")
        return {"success": False, "provider": provider, "error": str(e)}


@router.get("/methods", response_model=PaymentMethodsResponse)
def get_available_payment_methods(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """
    Get available payment methods.
    """
    settings = get_payment_settings(db)
    
    if not settings:
        return PaymentMethodsResponse(
            stripe_enabled=False,
            przelewy24_enabled=False,
            available_methods=[],
            default_currency="PLN",
        )
    
    from modules.payment.models import PaymentMethodType
    
    available_methods = []
    
    if settings.stripe_enabled:
        available_methods.extend([
            PaymentMethodType.CARD,
            PaymentMethodType.SEPA,
        ])
    
    if settings.przelewy24_enabled:
        available_methods.extend([
            PaymentMethodType.P24_TRANSFER,
            PaymentMethodType.P24_CARD,
            PaymentMethodType.P24_BLIK,
            PaymentMethodType.P24_APPLE_PAY,
            PaymentMethodType.P24_GOOGLE_PAY,
            PaymentMethodType.P24_PAYPO,
            PaymentMethodType.P24_INSTALLMENTS,
        ])
    
    return PaymentMethodsResponse(
        stripe_enabled=settings.stripe_enabled,
        przelewy24_enabled=settings.przelewy24_enabled,
        available_methods=available_methods,
        default_currency=settings.default_currency,
    )


# Transaction endpoints
@router.post("/transactions", response_model=PaymentTransactionRead, status_code=201)
async def create_payment_transaction(
    transaction_data: PaymentTransactionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.MANAGER])),
):
    """
    Create payment transaction.
    Generates payment URL for customer.
    """
    settings = get_payment_settings(db)
    if not settings:
        raise HTTPException(status_code=400, detail="Payment settings not configured")
    
    # Check if provider is enabled
    if transaction_data.provider == PaymentProvider.STRIPE and not settings.stripe_enabled:
        raise HTTPException(status_code=400, detail="Stripe not enabled")
    if transaction_data.provider == PaymentProvider.PRZELEWY24 and not settings.przelewy24_enabled:
        raise HTTPException(status_code=400, detail="Przelewy24 not enabled")
    
    # Check if order exists
    order = db.query(Order).filter(Order.id == transaction_data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Generate session ID
    import uuid
    session_id = f"ORDER_{order.order_number}_{uuid.uuid4().hex[:8]}"
    
    # Create transaction record
    transaction = PaymentTransaction(
        order_id=transaction_data.order_id,
        provider=transaction_data.provider,
        status=PaymentStatus.PENDING,
        payment_method=transaction_data.payment_method,
        amount=transaction_data.amount,
        currency=transaction_data.currency,
        session_id=session_id,
        customer_email=transaction_data.customer_email,
        customer_name=transaction_data.customer_name,
        description=transaction_data.description or f"Payment for order {order.order_number}",
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    # Generate payment URL based on provider
    try:
        if transaction_data.provider == PaymentProvider.STRIPE:
            service = StripeService(settings)
            
            # Use Checkout Session for easier integration
            from core.config import settings as app_settings
            frontend_url = app_settings.FRONTEND_URL or "http://localhost:5173"
            
            success_url = transaction_data.return_url or f"{frontend_url}/payments/success?session_id={session_id}"
            cancel_url = f"{frontend_url}/payments/cancel?session_id={session_id}"
            
            result = await service.create_checkout_session(
                amount=transaction.amount,
                currency=transaction.currency,
                customer_email=transaction.customer_email,
                success_url=success_url,
                cancel_url=cancel_url,
                description=transaction.description,
                metadata={"session_id": session_id, "order_id": str(order.id)},
            )
            
            transaction.provider_transaction_id = result["session_id"]
            transaction.payment_url = result["url"]
        
        elif transaction_data.provider == PaymentProvider.PRZELEWY24:
            service = Przelewy24Service(settings)
            
            from core.config import settings as app_settings
            frontend_url = app_settings.FRONTEND_URL or "http://localhost:5173"
            backend_url = app_settings.BACKEND_URL or "http://localhost:8000"
            
            return_url = transaction_data.return_url or f"{frontend_url}/payments/success?session_id={session_id}"
            status_url = f"{backend_url}/api/payment/webhooks/przelewy24"
            
            p24_request = P24TransactionRegisterRequest(
                order_id=order.id,
                amount=transaction.amount,
                currency=transaction.currency,
                customer_email=transaction.customer_email,
                customer_name=transaction.customer_name,
                description=transaction.description,
            )
            
            result = await service.register_transaction(
                request=p24_request,
                session_id=session_id,
                return_url=return_url,
                status_url=status_url,
            )
            
            transaction.provider_token = result.token
            transaction.payment_url = result.payment_url
            transaction.return_url = return_url
            transaction.webhook_url = status_url
        
        db.commit()
        db.refresh(transaction)
        
        return PaymentTransactionRead.model_validate(transaction)
    
    except Exception as e:
        logger.error(f"Failed to create payment: {e}")
        transaction.status = PaymentStatus.FAILED
        transaction.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to create payment: {str(e)}")


@router.get("/transactions", response_model=List[PaymentTransactionRead])
def get_payment_transactions(
    order_id: Optional[UUID] = None,
    status: Optional[PaymentStatus] = None,
    provider: Optional[PaymentProvider] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT])),
):
    """
    Get payment transactions list.
    Managers see only their orders.
    """
    user_scopes = get_user_scopes(user)
    
    query = db.query(PaymentTransaction).order_by(PaymentTransaction.created_at.desc())
    
    # Filter by order_id
    if order_id:
        query = query.filter(PaymentTransaction.order_id == order_id)
    
    # Filter by status
    if status:
        query = query.filter(PaymentTransaction.status == status)
    
    # Filter by provider
    if provider:
        query = query.filter(PaymentTransaction.provider == provider)
    
    # Scope filtering
    if Scope.CRM_VIEW_ALL not in user_scopes and Scope.ADMIN_ALL not in user_scopes:
        # Only own orders
        query = query.join(Order).filter(Order.manager_id == user.id)
    
    transactions = query.offset(skip).limit(limit).all()
    
    return [PaymentTransactionRead.model_validate(t) for t in transactions]


@router.get("/transactions/{transaction_id}", response_model=PaymentTransactionRead)
def get_payment_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """
    Get payment transaction by ID.
    """
    transaction = db.query(PaymentTransaction).filter(PaymentTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check access
    user_scopes = get_user_scopes(user)
    if Scope.CRM_VIEW_ALL not in user_scopes and Scope.ADMIN_ALL not in user_scopes:
        order = db.query(Order).filter(Order.id == transaction.order_id).first()
        if order and order.manager_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return PaymentTransactionRead.model_validate(transaction)


# Payment link endpoints
@router.post("/links", response_model=PaymentLinkRead, status_code=201)
async def create_payment_link(
    link_data: PaymentLinkCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.MANAGER])),
):
    """
    Create payment link and transaction.
    Manager can send payment link to customer.
    """
    # Create transaction first
    transaction_data = PaymentTransactionCreate(
        order_id=link_data.order_id,
        provider=link_data.provider,
        amount=link_data.amount,
        currency=link_data.currency,
        customer_email=link_data.customer_email,
        customer_name=link_data.customer_name,
        description=link_data.description,
    )
    
    transaction_response = await create_payment_transaction(transaction_data, db, user)
    
    # Get the created transaction
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.id == transaction_response.id
    ).first()
    
    if not transaction or not transaction.payment_url:
        raise HTTPException(status_code=500, detail="Failed to generate payment URL")
    
    # Create payment link record
    payment_link = PaymentLink(
        transaction_id=transaction.id,
        order_id=link_data.order_id,
        link_url=transaction.payment_url,
        expires_at=link_data.expires_at,
        sent_by_user_id=user.id,
        sent_to_email=link_data.customer_email,
    )
    
    db.add(payment_link)
    
    # Mark payment link as sent in timeline
    from modules.crm.services import timeline as timeline_service
    try:
        timeline_service.mark_payment_link_sent(
            db=db,
            order_id=link_data.order_id,
            sent_by_id=user.id,
            payment_link=payment_link.link_url
        )
    except Exception as e:
        logger.warning(f"Failed to mark payment link sent in timeline: {e}")
    
    db.commit()
    db.refresh(payment_link)
    
    # TODO: Send email with payment link
    logger.info(f"Payment link created: {payment_link.link_url} for order {link_data.order_id}")
    
    return PaymentLinkRead.model_validate(payment_link)


@router.get("/links", response_model=List[PaymentLinkRead])
def get_payment_links(
    order_id: Optional[UUID] = None,
    is_used: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.MANAGER])),
):
    """
    Get payment links.
    """
    user_scopes = get_user_scopes(user)
    
    query = db.query(PaymentLink).order_by(PaymentLink.created_at.desc())
    
    if order_id:
        query = query.filter(PaymentLink.order_id == order_id)
    
    if is_used is not None:
        query = query.filter(PaymentLink.is_used == is_used)
    
    # Scope filtering
    if Scope.CRM_VIEW_ALL not in user_scopes and Scope.ADMIN_ALL not in user_scopes:
        query = query.filter(PaymentLink.sent_by_user_id == user.id)
    
    links = query.offset(skip).limit(limit).all()
    
    return [PaymentLinkRead.model_validate(link) for link in links]


# Webhook endpoints
@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Stripe webhook handler.
    """
    settings = get_payment_settings(db)
    if not settings or not settings.stripe_enabled:
        raise HTTPException(status_code=400, detail="Stripe not configured")
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing signature")
    
    service = StripeService(settings)
    
    try:
        event = service.verify_webhook_signature(payload, sig_header)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle event
    event_type = event["type"]
    data = event["data"]["object"]
    
    logger.info(f"Stripe webhook received: {event_type}")
    
    if event_type == "checkout.session.completed":
        # Checkout completed
        session_id = data.get("id")
        metadata = data.get("metadata", {})
        internal_session_id = metadata.get("session_id")
        
        if internal_session_id:
            transaction = db.query(PaymentTransaction).filter(
                PaymentTransaction.session_id == internal_session_id
            ).first()
            
            if transaction:
                transaction.status = PaymentStatus.COMPLETED
                transaction.provider_transaction_id = session_id
                transaction.completed_at = datetime.utcnow()
                
                # Get payment method from checkout session
                payment_method_type = data.get("payment_method_types", ["card"])[0] if data.get("payment_method_types") else "card"
                transaction.payment_method = service.get_payment_method_type(payment_method_type)
                
                # Update order status to "oplacone" (paid)
                order = db.query(Order).filter(Order.id == transaction.order_id).first()
                if order:
                    order.status = "oplacone"
                    # Update payment_method in order based on actual payment method
                    payment_method_map = {
                        "card": "card",
                        "p24_card": "card",
                        "p24_transfer": "transfer",
                        "p24_blik": "card",
                        "sepa": "transfer",
                    }
                    order.payment_method = payment_method_map.get(
                        transaction.payment_method.value if transaction.payment_method else "card",
                        "card"
                    )
                
                # Create finance transaction (only on successful payment)
                await create_finance_transaction_from_payment(transaction, db)
                
                db.commit()
    
    elif event_type == "payment_intent.succeeded":
        payment_intent_id = data.get("id")
        metadata = data.get("metadata", {})
        internal_session_id = metadata.get("session_id")
        
        if internal_session_id:
            transaction = db.query(PaymentTransaction).filter(
                PaymentTransaction.session_id == internal_session_id
            ).first()
            
            if transaction:
                transaction.status = PaymentStatus.COMPLETED
                transaction.provider_transaction_id = payment_intent_id
                transaction.completed_at = datetime.utcnow()
                
                # Get payment method type
                payment_method_type = data.get("payment_method_types", ["card"])[0]
                transaction.payment_method = service.get_payment_method_type(payment_method_type)
                
                # Update order status to "oplacone" (paid)
                order = db.query(Order).filter(Order.id == transaction.order_id).first()
                if order:
                    order.status = "oplacone"
                    # Update payment_method in order based on actual payment method
                    payment_method_map = {
                        "card": "card",
                        "p24_card": "card",
                        "p24_transfer": "transfer",
                        "p24_blik": "card",
                        "sepa": "transfer",
                    }
                    order.payment_method = payment_method_map.get(
                        transaction.payment_method.value if transaction.payment_method else "card",
                        "card"
                    )
                
                # Create finance transaction (only on successful payment)
                await create_finance_transaction_from_payment(transaction, db)
                
                db.commit()
    
    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = data.get("id")
        metadata = data.get("metadata", {})
        internal_session_id = metadata.get("session_id")
        
        if internal_session_id:
            transaction = db.query(PaymentTransaction).filter(
                PaymentTransaction.session_id == internal_session_id
            ).first()
            
            if transaction:
                transaction.status = PaymentStatus.FAILED
                transaction.error_message = data.get("last_payment_error", {}).get("message")
                
                # Order status remains unchanged on failed payment
                # (stays as "do_wykonania" or current status)
                
                db.commit()
    
    return {"received": True}


@router.post("/webhooks/przelewy24")
async def przelewy24_webhook(
    webhook_data: P24NotificationWebhook = Body(...),
    db: Session = Depends(get_db),
):
    """
    Przelewy24 webhook handler.
    """
    settings = get_payment_settings(db)
    if not settings or not settings.przelewy24_enabled:
        raise HTTPException(status_code=400, detail="Przelewy24 not configured")
    
    service = Przelewy24Service(settings)
    
    # Verify signature
    if not service.verify_notification_signature(webhook_data):
        logger.error("Invalid P24 webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    logger.info(f"P24 webhook received for session: {webhook_data.sessionId}")
    
    # Find transaction
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.session_id == webhook_data.sessionId
    ).first()
    
    if not transaction:
        logger.error(f"Transaction not found for session: {webhook_data.sessionId}")
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Verify transaction with P24
    is_verified = await service.verify_transaction(
        session_id=webhook_data.sessionId,
        order_id=webhook_data.orderId,
        amount=webhook_data.amount,
        currency=webhook_data.currency,
    )
    
    if not is_verified:
        logger.error(f"P24 verification failed for session: {webhook_data.sessionId}")
        transaction.status = PaymentStatus.FAILED
        transaction.error_message = "Verification failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Verification failed")
    
    # Update transaction
    transaction.status = PaymentStatus.COMPLETED
    transaction.provider_transaction_id = str(webhook_data.orderId)
    transaction.completed_at = datetime.utcnow()
    
    # Map method ID to type
    transaction.payment_method = service.map_method_id_to_type(webhook_data.methodId)
    
    # Update order status to "oplacone" (paid)
    order = db.query(Order).filter(Order.id == transaction.order_id).first()
    if order:
        order.status = "oplacone"
        # Update payment_method in order based on actual payment method
        payment_method_map = {
            "p24_card": "card",
            "p24_transfer": "transfer",
            "p24_blik": "card",
            "p24_paypo": "card",
            "p24_installments": "card",
        }
        order.payment_method = payment_method_map.get(
            transaction.payment_method.value if transaction.payment_method else "transfer",
            "transfer"
        )
    
    # Create finance transaction (only on successful payment)
    await create_finance_transaction_from_payment(transaction, db)
    
    db.commit()
    
    return {"received": True, "verified": True}


# Helper function to create finance transaction
async def create_finance_transaction_from_payment(transaction: PaymentTransaction, db: Session):
    """Create finance transaction from payment transaction."""
    try:
        # Map payment method
        payment_method_map = {
            "card": PaymentMethod.CARD,
            "p24_card": PaymentMethod.CARD,
            "p24_transfer": PaymentMethod.TRANSFER,
            "p24_blik": PaymentMethod.BLIK,
            "sepa": PaymentMethod.TRANSFER,
        }
        
        payment_method = payment_method_map.get(
            transaction.payment_method.value if transaction.payment_method else "transfer",
            PaymentMethod.TRANSFER
        )
        
        # Check if finance transaction already exists
        existing = db.query(FinanceTransaction).filter(
            and_(
                FinanceTransaction.order_id == transaction.order_id,
                FinanceTransaction.receipt_number == f"PAY-{transaction.session_id}"
            )
        ).first()
        
        if existing:
            logger.info(f"Finance transaction already exists for payment {transaction.id}")
            return
        
        # Create finance transaction
        finance_transaction = FinanceTransaction(
            order_id=transaction.order_id,
            amount_gross=transaction.amount,
            payment_date=transaction.completed_at.date() if transaction.completed_at else datetime.utcnow().date(),
            service_date=datetime.utcnow().date(),
            receipt_number=f"PAY-{transaction.session_id}",
            payment_method=payment_method,
            notes=f"Automatic payment via {transaction.provider.value}",
        )
        
        db.add(finance_transaction)
        logger.info(f"Created finance transaction for payment {transaction.id}")
    
    except Exception as e:
        logger.error(f"Failed to create finance transaction: {e}")


# Statistics endpoint
@router.get("/stats", response_model=PaymentStatsResponse)
def get_payment_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.ACCOUNTANT])),
):
    """
    Get payment statistics.
    Only owner and accountant can view.
    """
    # Default date range: last 30 days
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    query = db.query(PaymentTransaction).filter(
        and_(
            PaymentTransaction.created_at >= start_date,
            PaymentTransaction.created_at <= end_date
        )
    )
    
    transactions = query.all()
    
    total_amount = sum(t.amount for t in transactions if t.status == PaymentStatus.COMPLETED)
    
    by_provider = {}
    by_status = {}
    
    for t in transactions:
        # Count by provider
        provider_key = t.provider.value
        by_provider[provider_key] = by_provider.get(provider_key, 0) + 1
        
        # Count by status
        status_key = t.status.value
        by_status[status_key] = by_status.get(status_key, 0) + 1
    
    successful = sum(1 for t in transactions if t.status == PaymentStatus.COMPLETED)
    failed = sum(1 for t in transactions if t.status == PaymentStatus.FAILED)
    pending = sum(1 for t in transactions if t.status == PaymentStatus.PENDING)
    
    return PaymentStatsResponse(
        total_transactions=len(transactions),
        total_amount=total_amount,
        successful_transactions=successful,
        failed_transactions=failed,
        pending_transactions=pending,
        by_provider=by_provider,
        by_status=by_status,
        period_start=start_date,
        period_end=end_date,
    )

