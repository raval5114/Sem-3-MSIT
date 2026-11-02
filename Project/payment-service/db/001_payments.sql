CREATE TABLE IF NOT EXISTS dineflow_payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  restaurant_id TEXT NOT NULL,
  table_id UUID,
  table_session_id UUID,
  customer_id TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  provider TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'STRIPE', 'SANDBOX')),
  provider_order_id TEXT,
  provider_payment_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED')),
  payment_method TEXT NOT NULL DEFAULT 'ONLINE',
  idempotency_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dineflow_payments_order ON dineflow_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_dineflow_payments_restaurant_session ON dineflow_payments (restaurant_id, table_session_id);
CREATE INDEX IF NOT EXISTS idx_dineflow_payments_provider_order ON dineflow_payments (provider_order_id);

