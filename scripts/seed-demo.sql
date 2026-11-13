INSERT INTO employees (name, role, phone, is_active) VALUES
  (E'\u0645\u062f\u064a\u0631 \u0627\u0644\u0646\u0638\u0627\u0645', 'admin', '0700000001', true),
  (E'\u0623\u062d\u0645\u062f \u0627\u0644\u0645\u062f\u064a\u0631', 'manager', '0700000002', true),
  (E'\u0633\u0627\u0631\u0629 \u0627\u0644\u0643\u0627\u0634\u064a\u0631', 'cashier', '0700000003', true),
  (E'\u0645\u062d\u0645\u062f \u0627\u0644\u0645\u0637\u0628\u062e', 'kitchen', '0700000004', true),
  (E'\u0639\u0644\u064a \u0627\u0644\u0646\u0627\u062f\u0644', 'waiter', '0700000005', true);

INSERT INTO restaurant_tables (number, capacity, status, location) VALUES
  ('1', 4, 'available', 'hall'),
  ('2', 4, 'available', 'hall'),
  ('3', 6, 'available', 'terrace'),
  ('4', 2, 'available', 'VIP');
