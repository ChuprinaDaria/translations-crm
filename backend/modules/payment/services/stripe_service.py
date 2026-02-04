"""
Stripe payment service.
"""
from typing import Optional, Dict, Any
from decimal import Decimal
import stripe
from uuid import UUID

from modules.payment.models import PaymentSettings, PaymentStatus, PaymentMethodType


class StripeService:
    """Stripe payment integration service."""
    
    def __init__(self, settings: PaymentSettings):
        """
        Initialize Stripe service with settings.
        
        Args:
            settings: PaymentSettings instance with Stripe credentials
        """
        self.settings = settings
        self.secret_key = settings.stripe_secret_key
        self.public_key = settings.stripe_public_key
        self.webhook_secret = settings.stripe_webhook_secret
        
        # Set Stripe API key
        stripe.api_key = self.secret_key
    
    def _to_cents(self, amount: Decimal, currency: str = "pln") -> int:
        """
        Convert amount to cents/groszy.
        For zero-decimal currencies (e.g., JPY), don't multiply by 100.
        
        Args:
            amount: Amount in main currency unit
            currency: Currency code
        
        Returns:
            Amount in smallest currency unit
        """
        # Zero-decimal currencies
        zero_decimal_currencies = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]
        
        if currency.lower() in zero_decimal_currencies:
            return int(amount)
        else:
            return int(amount * 100)
    
    def _from_cents(self, amount: int, currency: str = "pln") -> Decimal:
        """
        Convert cents/groszy to main currency unit.
        
        Args:
            amount: Amount in smallest currency unit
            currency: Currency code
        
        Returns:
            Amount in main currency unit
        """
        zero_decimal_currencies = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]
        
        if currency.lower() in zero_decimal_currencies:
            return Decimal(amount)
        else:
            return Decimal(amount) / 100
    
    async def test_connection(self) -> bool:
        """
        Test Stripe API connection.
        
        Returns:
            True if connection successful
        """
        try:
            # Try to retrieve account info
            stripe.Account.retrieve()
            return True
        except Exception:
            return False
    
    async def create_payment_intent(
        self,
        amount: Decimal,
        currency: str,
        customer_email: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        payment_method_types: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """
        Create Stripe Payment Intent.
        
        Args:
            amount: Amount in main currency unit
            currency: Currency code (e.g., 'pln', 'eur', 'usd')
            customer_email: Customer email
            description: Payment description
            metadata: Additional metadata
            payment_method_types: List of payment method types (default: ['card'])
        
        Returns:
            Payment Intent data with client_secret
        
        Raises:
            Exception: If creation fails
        """
        if payment_method_types is None:
            payment_method_types = ["card"]
        
        amount_cents = self._to_cents(amount, currency)
        
        try:
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=currency.lower(),
                receipt_email=customer_email,
                description=description,
                metadata=metadata or {},
                payment_method_types=payment_method_types,
                automatic_payment_methods={
                    "enabled": True,
                    "allow_redirects": "never",
                } if len(payment_method_types) > 1 else None,
            )
            
            return {
                "client_secret": intent.client_secret,
                "payment_intent_id": intent.id,
                "amount": amount,
                "currency": currency,
                "status": intent.status,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def retrieve_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """
        Retrieve Payment Intent.
        
        Args:
            payment_intent_id: Stripe Payment Intent ID
        
        Returns:
            Payment Intent data
        """
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                "id": intent.id,
                "amount": self._from_cents(intent.amount, intent.currency),
                "currency": intent.currency,
                "status": intent.status,
                "customer_email": intent.receipt_email,
                "description": intent.description,
                "metadata": intent.metadata,
                "payment_method": intent.payment_method,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def confirm_payment_intent(self, payment_intent_id: str, payment_method: Optional[str] = None) -> Dict[str, Any]:
        """
        Confirm Payment Intent.
        
        Args:
            payment_intent_id: Stripe Payment Intent ID
            payment_method: Payment method ID (optional)
        
        Returns:
            Updated Payment Intent data
        """
        try:
            params = {}
            if payment_method:
                params["payment_method"] = payment_method
            
            intent = stripe.PaymentIntent.confirm(payment_intent_id, **params)
            return {
                "id": intent.id,
                "status": intent.status,
                "amount": self._from_cents(intent.amount, intent.currency),
                "currency": intent.currency,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def cancel_payment_intent(self, payment_intent_id: str) -> bool:
        """
        Cancel Payment Intent.
        
        Args:
            payment_intent_id: Stripe Payment Intent ID
        
        Returns:
            True if cancelled successfully
        """
        try:
            intent = stripe.PaymentIntent.cancel(payment_intent_id)
            return intent.status == "canceled"
        except stripe.error.StripeError:
            return False
    
    async def create_refund(
        self,
        payment_intent_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create refund for Payment Intent.
        
        Args:
            payment_intent_id: Stripe Payment Intent ID
            amount: Amount to refund (None for full refund)
            reason: Refund reason ('duplicate', 'fraudulent', 'requested_by_customer')
        
        Returns:
            Refund data
        """
        try:
            params = {"payment_intent": payment_intent_id}
            
            if amount:
                # Get currency from payment intent first
                intent = stripe.PaymentIntent.retrieve(payment_intent_id)
                params["amount"] = self._to_cents(amount, intent.currency)
            
            if reason:
                params["reason"] = reason
            
            refund = stripe.Refund.create(**params)
            
            return {
                "id": refund.id,
                "amount": self._from_cents(refund.amount, refund.currency),
                "currency": refund.currency,
                "status": refund.status,
                "reason": refund.reason,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def create_checkout_session(
        self,
        amount: Decimal,
        currency: str,
        customer_email: str,
        success_url: str,
        cancel_url: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create Stripe Checkout Session (hosted payment page).
        
        Args:
            amount: Amount in main currency unit
            currency: Currency code
            customer_email: Customer email
            success_url: URL to redirect on success
            cancel_url: URL to redirect on cancel
            description: Payment description
            metadata: Additional metadata
        
        Returns:
            Checkout Session data with URL
        """
        amount_cents = self._to_cents(amount, currency)
        
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": currency.lower(),
                        "unit_amount": amount_cents,
                        "product_data": {
                            "name": description or "Payment",
                        },
                    },
                    "quantity": 1,
                }],
                mode="payment",
                success_url=success_url,
                cancel_url=cancel_url,
                customer_email=customer_email,
                metadata=metadata or {},
            )
            
            return {
                "session_id": session.id,
                "url": session.url,
                "payment_status": session.payment_status,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> Dict[str, Any]:
        """
        Verify Stripe webhook signature.
        
        Args:
            payload: Raw request body
            signature: Stripe-Signature header value
        
        Returns:
            Verified event data
        
        Raises:
            ValueError: If signature is invalid
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return event
        except ValueError:
            raise ValueError("Invalid signature")
        except stripe.error.SignatureVerificationError:
            raise ValueError("Invalid signature")
    
    def map_stripe_status_to_payment_status(self, stripe_status: str) -> PaymentStatus:
        """
        Map Stripe status to PaymentStatus.
        
        Args:
            stripe_status: Stripe payment status
        
        Returns:
            PaymentStatus
        """
        status_map = {
            "requires_payment_method": PaymentStatus.PENDING,
            "requires_confirmation": PaymentStatus.PENDING,
            "requires_action": PaymentStatus.PENDING,
            "processing": PaymentStatus.PROCESSING,
            "succeeded": PaymentStatus.COMPLETED,
            "canceled": PaymentStatus.CANCELLED,
            "failed": PaymentStatus.FAILED,
        }
        return status_map.get(stripe_status, PaymentStatus.PENDING)
    
    def get_payment_method_type(self, payment_method_type: str) -> PaymentMethodType:
        """
        Get PaymentMethodType from Stripe payment method type.
        
        Args:
            payment_method_type: Stripe payment method type
        
        Returns:
            PaymentMethodType
        """
        type_map = {
            "card": PaymentMethodType.CARD,
            "sepa_debit": PaymentMethodType.SEPA,
        }
        return type_map.get(payment_method_type, PaymentMethodType.CARD)

