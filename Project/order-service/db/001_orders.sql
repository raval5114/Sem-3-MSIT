CREATE TABLE IF NOT EXISTS dineflow_orders (
  id UUID PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  table_id UUID NOT NULL,
  table_session_id UUID NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUBMITTED','PAYMENT_PENDING','PENDING_KITCHEN','ACCEPTED','PREPARING','READY','SERVED','COMPLETED','CANCELLED')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('PAY_AT_COUNTER','ONLINE')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('UNPAID','PENDING','PAID','FAILED','REFUNDED')),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dineflow_orders_session_created
  ON dineflow_orders (restaurant_id, table_session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dineflow_order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES dineflow_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  selections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dineflow_order_items_order ON dineflow_order_items (order_id);
