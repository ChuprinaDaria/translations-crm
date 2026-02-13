import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export function PaymentSuccessPage() {
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    // Update page title
    document.title = 'Payment Successful';
    
    // Enable close button after a short delay
    const timer = setTimeout(() => {
      setCanClose(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    // Try to close the window (works if opened via window.open)
    if (window.opener) {
      window.close();
    } else {
      // If can't close, redirect to home or show message
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-green-500 rounded-full p-4">
                <CheckCircle2 className="w-16 h-16 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Payment Successful!
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-600 mb-2">
            Thank you for your payment.
          </p>
          <p className="text-base text-gray-500 mb-8">
            Your transaction has been completed successfully. You will receive a confirmation email shortly.
          </p>

          {/* Decorative Divider */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex-1 border-t border-gray-200"></div>
            <div className="px-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Additional Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              If you have any questions about your payment, please contact our support team.
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            disabled={!canClose}
            className={`w-full font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md ${
              canClose
                ? 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canClose ? 'Close Window' : 'Processing...'}
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-500 mt-6">
          This window can be safely closed.
        </p>
      </div>
    </div>
  );
}

