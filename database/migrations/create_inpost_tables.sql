-- Create InPost tables migration
-- Created: 2026-02-04

-- InPost Settings table
CREATE TABLE IF NOT EXISTS inpost_settings (
    id SERIAL PRIMARY KEY,
    
    -- API Configuration
    api_key VARCHAR(255),
    api_url VARCHAR(500) NOT NULL DEFAULT 'https://api-shipx-pl.easypack24.net/v1',
    
    -- Sandbox mode
    sandbox_mode BOOLEAN NOT NULL DEFAULT FALSE,
    sandbox_api_key VARCHAR(255),
    sandbox_api_url VARCHAR(500) NOT NULL DEFAULT 'https://sandbox-api-shipx-pl.easypack24.net/v1',
    
    -- Webhook
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    
    -- Default sender info
    default_sender_email VARCHAR(255),
    default_sender_phone VARCHAR(20),
    default_sender_name VARCHAR(255),
    
    -- Enable/Disable
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on updated_at
CREATE INDEX IF NOT EXISTS idx_inpost_settings_updated_at ON inpost_settings(updated_at);

-- InPost Shipments table
CREATE TABLE IF NOT EXISTS inpost_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Order reference
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    -- InPost shipment ID
    shipment_id VARCHAR(100),
    tracking_number VARCHAR(100),
    
    -- Delivery info
    delivery_type VARCHAR(50) NOT NULL DEFAULT 'parcel_locker',
    
    -- Parcel locker
    parcel_locker_code VARCHAR(20),
    
    -- Courier address
    courier_address TEXT,
    courier_street VARCHAR(200),
    courier_building_number VARCHAR(20),
    courier_flat_number VARCHAR(20),
    courier_city VARCHAR(100),
    courier_post_code VARCHAR(10),
    courier_country VARCHAR(2) DEFAULT 'PL',
    
    -- Receiver info
    receiver_email VARCHAR(255),
    receiver_phone VARCHAR(20),
    receiver_name VARCHAR(255),
    
    -- Sender info
    sender_email VARCHAR(255),
    sender_phone VARCHAR(20),
    sender_name VARCHAR(255),
    
    -- Package info
    package_size VARCHAR(20) DEFAULT 'small',
    package_weight DECIMAL(10, 2),
    
    -- Insurance
    insurance_amount DECIMAL(10, 2),
    
    -- COD (Cash on Delivery)
    cod_amount DECIMAL(10, 2),
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'created',
    status_description TEXT,
    
    -- Tracking URL
    tracking_url VARCHAR(500),
    
    -- Label
    label_url VARCHAR(500),
    
    -- Cost
    cost DECIMAL(10, 2),
    
    -- Response from InPost API (JSONB)
    inpost_response JSONB DEFAULT '{}',
    
    -- Status history (JSONB array)
    status_history JSONB DEFAULT '[]',
    
    -- Error info
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inpost_shipments_order_id ON inpost_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_inpost_shipments_shipment_id ON inpost_shipments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_inpost_shipments_tracking_number ON inpost_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_inpost_shipments_status ON inpost_shipments(status);
CREATE INDEX IF NOT EXISTS idx_inpost_shipments_created_at ON inpost_shipments(created_at);
CREATE INDEX IF NOT EXISTS idx_inpost_shipments_updated_at ON inpost_shipments(updated_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inpost_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inpost_settings_updated_at
    BEFORE UPDATE ON inpost_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_inpost_updated_at();

CREATE TRIGGER trigger_update_inpost_shipments_updated_at
    BEFORE UPDATE ON inpost_shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_inpost_updated_at();

-- Insert default settings row
INSERT INTO inpost_settings (
    api_url,
    sandbox_api_url,
    is_enabled
) VALUES (
    'https://api-shipx-pl.easypack24.net/v1',
    'https://sandbox-api-shipx-pl.easypack24.net/v1',
    FALSE
) ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE inpost_settings IS 'InPost API configuration and settings';
COMMENT ON TABLE inpost_shipments IS 'InPost shipments tracking and management';

COMMENT ON COLUMN inpost_shipments.order_id IS 'Reference to CRM order';
COMMENT ON COLUMN inpost_shipments.shipment_id IS 'InPost shipment ID from API';
COMMENT ON COLUMN inpost_shipments.tracking_number IS 'Public tracking number';
COMMENT ON COLUMN inpost_shipments.parcel_locker_code IS 'Parcel locker code (e.g., KRA010)';
COMMENT ON COLUMN inpost_shipments.package_size IS 'Package size: small, medium, large';
COMMENT ON COLUMN inpost_shipments.package_weight IS 'Package weight in kg';
COMMENT ON COLUMN inpost_shipments.insurance_amount IS 'Insurance amount in PLN';
COMMENT ON COLUMN inpost_shipments.cod_amount IS 'Cash on delivery amount in PLN';
COMMENT ON COLUMN inpost_shipments.inpost_response IS 'Full response from InPost API';
COMMENT ON COLUMN inpost_shipments.status_history IS 'Array of status change events';

