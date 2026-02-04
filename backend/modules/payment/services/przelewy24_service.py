"""
Przelewy24 payment service.
"""
import hashlib
import json
import base64
from typing import Optional, Dict, Any
from decimal import Decimal
import httpx
from uuid import UUID
from datetime import datetime

from modules.payment.models import PaymentSettings, PaymentStatus, PaymentMethodType
from modules.payment.schemas import (
    P24TransactionRegisterRequest,
    P24TransactionRegisterResponse,
    P24NotificationWebhook,
    P24VerifyRequest,
)


class Przelewy24Service:
    """Przelewy24 payment integration service."""
    
    def __init__(self, settings: PaymentSettings):
        """
        Initialize P24 service with settings.
        
        Args:
            settings: PaymentSettings instance with P24 credentials
        """
        self.settings = settings
        self.merchant_id = settings.przelewy24_merchant_id
        self.pos_id = settings.przelewy24_pos_id
        self.crc = settings.przelewy24_crc
        self.api_key = settings.przelewy24_api_key
        self.sandbox = settings.przelewy24_sandbox
        
        # Set base URLs
        if self.sandbox:
            self.api_base_url = "https://sandbox.przelewy24.pl/api/v1"
            self.payment_base_url = "https://sandbox.przelewy24.pl"
        else:
            self.api_base_url = "https://secure.przelewy24.pl/api/v1"
            self.payment_base_url = "https://secure.przelewy24.pl"
    
    def _calculate_sign_register(self, session_id: str, amount: int, currency: str) -> str:
        """
        Calculate sign for transaction registration.
        
        Args:
            session_id: Unique session ID
            amount: Amount in groszy (1 PLN = 100 groszy)
            currency: Currency code
        
        Returns:
            SHA384 hash
        """
        data = {
            "sessionId": session_id,
            "merchantId": self.merchant_id,
            "amount": amount,
            "currency": currency,
            "crc": self.crc
        }
        json_string = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        return hashlib.sha384(json_string.encode('utf-8')).hexdigest()
    
    def _calculate_sign_verify(self, session_id: str, order_id: int, amount: int, currency: str) -> str:
        """
        Calculate sign for transaction verification.
        
        Args:
            session_id: Unique session ID
            order_id: P24 order ID
            amount: Amount in groszy
            currency: Currency code
        
        Returns:
            SHA384 hash
        """
        data = {
            "sessionId": session_id,
            "orderId": order_id,
            "amount": amount,
            "currency": currency,
            "crc": self.crc
        }
        json_string = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        return hashlib.sha384(json_string.encode('utf-8')).hexdigest()
    
    def _calculate_sign_notification(self, webhook: P24NotificationWebhook) -> str:
        """
        Calculate sign for notification verification.
        
        Args:
            webhook: P24NotificationWebhook data
        
        Returns:
            SHA384 hash
        """
        data = {
            "merchantId": webhook.merchantId,
            "posId": webhook.posId,
            "sessionId": webhook.sessionId,
            "amount": webhook.amount,
            "originAmount": webhook.originAmount,
            "currency": webhook.currency,
            "orderId": webhook.orderId,
            "methodId": webhook.methodId,
            "statement": webhook.statement,
            "crc": self.crc
        }
        json_string = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        return hashlib.sha384(json_string.encode('utf-8')).hexdigest()
    
    def _to_groszy(self, amount: Decimal) -> int:
        """Convert PLN to groszy (1 PLN = 100 groszy)."""
        return int(amount * 100)
    
    def _from_groszy(self, amount: int) -> Decimal:
        """Convert groszy to PLN."""
        return Decimal(amount) / 100
    
    async def test_connection(self) -> bool:
        """
        Test P24 API connection.
        
        Returns:
            True if connection successful
        """
        url = f"{self.api_base_url}/testAccess"
        
        auth = httpx.BasicAuth(str(self.pos_id), self.api_key)
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, auth=auth, timeout=10.0)
                return response.status_code == 200
            except Exception:
                return False
    
    async def register_transaction(
        self,
        request: P24TransactionRegisterRequest,
        session_id: str,
        return_url: str,
        status_url: str,
    ) -> P24TransactionRegisterResponse:
        """
        Register transaction in P24.
        
        Args:
            request: Transaction register request
            session_id: Unique session ID
            return_url: URL to redirect after payment
            status_url: URL for webhook notifications
        
        Returns:
            P24TransactionRegisterResponse with token and payment URL
        
        Raises:
            Exception: If registration fails
        """
        url = f"{self.api_base_url}/transaction/register"
        
        amount_groszy = self._to_groszy(request.amount)
        sign = self._calculate_sign_register(session_id, amount_groszy, request.currency)
        
        payload = {
            "merchantId": self.merchant_id,
            "posId": self.pos_id,
            "sessionId": session_id,
            "amount": amount_groszy,
            "currency": request.currency,
            "description": request.description,
            "email": request.customer_email,
            "country": request.customer_country,
            "language": request.language,
            "urlReturn": return_url,
            "urlStatus": status_url,
            "sign": sign,
        }
        
        # Optional fields
        if request.customer_name:
            payload["client"] = request.customer_name
        if request.customer_address:
            payload["address"] = request.customer_address
        if request.customer_city:
            payload["city"] = request.customer_city
        if request.customer_zip:
            payload["zip"] = request.customer_zip
        if request.customer_phone:
            payload["phone"] = request.customer_phone
        if request.method:
            payload["method"] = request.method
        if request.channel:
            payload["channel"] = request.channel
        
        auth = httpx.BasicAuth(str(self.pos_id), self.api_key)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                auth=auth,
                timeout=30.0,
            )
            
            if response.status_code != 200:
                raise Exception(f"P24 registration failed: {response.text}")
            
            data = response.json()
            token = data["data"]["token"]
            payment_url = f"{self.payment_base_url}/trnRequest/{token}"
            
            return P24TransactionRegisterResponse(
                token=token,
                payment_url=payment_url,
            )
    
    async def verify_transaction(
        self,
        session_id: str,
        order_id: int,
        amount: int,
        currency: str,
    ) -> bool:
        """
        Verify transaction in P24.
        
        Args:
            session_id: Unique session ID
            order_id: P24 order ID from notification
            amount: Amount in groszy
            currency: Currency code
        
        Returns:
            True if verification successful
        """
        url = f"{self.api_base_url}/transaction/verify"
        
        sign = self._calculate_sign_verify(session_id, order_id, amount, currency)
        
        payload = {
            "merchantId": self.merchant_id,
            "posId": self.pos_id,
            "sessionId": session_id,
            "amount": amount,
            "currency": currency,
            "orderId": order_id,
            "sign": sign,
        }
        
        auth = httpx.BasicAuth(str(self.pos_id), self.api_key)
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                json=payload,
                auth=auth,
                timeout=30.0,
            )
            
            if response.status_code != 200:
                return False
            
            data = response.json()
            return data.get("data", {}).get("status") == "success"
    
    def verify_notification_signature(self, webhook: P24NotificationWebhook) -> bool:
        """
        Verify notification signature.
        
        Args:
            webhook: P24NotificationWebhook data
        
        Returns:
            True if signature is valid
        """
        calculated_sign = self._calculate_sign_notification(webhook)
        return calculated_sign == webhook.sign
    
    async def get_payment_methods(self, lang: str = "pl", amount: Optional[int] = None, currency: str = "PLN") -> list[Dict[str, Any]]:
        """
        Get available payment methods.
        
        Args:
            lang: Language code (pl, en)
            amount: Amount in groszy (optional, to filter methods)
            currency: Currency code
        
        Returns:
            List of payment methods
        """
        url = f"{self.api_base_url}/payment/methods/{lang}"
        params = {"currency": currency}
        if amount:
            params["amount"] = amount
        
        auth = httpx.BasicAuth(str(self.pos_id), self.api_key)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                params=params,
                auth=auth,
                timeout=10.0,
            )
            
            if response.status_code != 200:
                return []
            
            data = response.json()
            return data.get("data", [])
    
    async def refund_transaction(
        self,
        order_id: int,
        session_id: str,
        amount: Optional[int] = None,
        description: Optional[str] = None,
    ) -> bool:
        """
        Refund transaction.
        
        Args:
            order_id: P24 order ID
            session_id: Session ID
            amount: Amount to refund in groszy (optional, full refund if None)
            description: Refund description
        
        Returns:
            True if refund successful
        """
        url = f"{self.api_base_url}/transaction/refund"
        
        import uuid
        request_id = str(uuid.uuid4())
        refunds_uuid = str(uuid.uuid4())
        
        refund_data = {
            "orderId": order_id,
            "sessionId": session_id,
        }
        
        if amount:
            refund_data["amount"] = amount
        if description:
            refund_data["description"] = description
        
        payload = {
            "requestId": request_id,
            "refunds": [refund_data],
            "refundsUuid": refunds_uuid,
        }
        
        auth = httpx.BasicAuth(str(self.pos_id), self.api_key)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                auth=auth,
                timeout=30.0,
            )
            
            return response.status_code == 201
    
    def map_method_id_to_type(self, method_id: int) -> PaymentMethodType:
        """
        Map P24 method ID to PaymentMethodType.
        
        Args:
            method_id: P24 method ID
        
        Returns:
            PaymentMethodType
        """
        # Common P24 method IDs
        method_map = {
            25: PaymentMethodType.P24_TRANSFER,  # mTransfer
            31: PaymentMethodType.P24_TRANSFER,  # ING
            32: PaymentMethodType.P24_TRANSFER,  # Pekao
            154: PaymentMethodType.P24_BLIK,  # BLIK
            289: PaymentMethodType.P24_GOOGLE_PAY,  # Google Pay
            290: PaymentMethodType.P24_APPLE_PAY,  # Apple Pay
            303: PaymentMethodType.P24_INSTALLMENTS,  # Raty
        }
        
        return method_map.get(method_id, PaymentMethodType.P24_TRANSFER)

