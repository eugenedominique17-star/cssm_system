BEGIN;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE EXCEPTION 'Order status Realtime policy requires Supabase Realtime to be enabled.';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Clients can receive their own order status broadcasts"
  ON realtime.messages;

CREATE POLICY "Clients can receive their own order status broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() = 'order-status:' || (SELECT auth.uid()::text)
  );

COMMIT;
