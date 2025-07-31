-- Add updated_at field to payment_receipts table for edit tracking
ALTER TABLE payment_receipts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP; 