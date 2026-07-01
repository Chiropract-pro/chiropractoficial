-- ============================================
-- Función atómica para descontar stock
-- Previene race conditions cuando dos ventas concurrentes
-- intentan descontar del mismo producto.
-- ============================================

CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_id UUID, qty INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock INT;
  product_tenant UUID;
BEGIN
  IF qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;

  -- Lock row para evitar race condition
  SELECT tenant_id INTO product_tenant
  FROM products
  WHERE id = p_id
  FOR UPDATE;

  IF product_tenant IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  -- Verificar que el caller pertenece al tenant del producto
  IF NOT public.is_tenant_member(product_tenant) THEN
    RAISE EXCEPTION 'No tienes permiso sobre este producto';
  END IF;

  UPDATE products
  SET stock = GREATEST(0, stock - qty),
      updated_at = NOW()
  WHERE id = p_id
  RETURNING stock INTO new_stock;

  RETURN new_stock;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_product_stock(UUID, INT) TO authenticated;
