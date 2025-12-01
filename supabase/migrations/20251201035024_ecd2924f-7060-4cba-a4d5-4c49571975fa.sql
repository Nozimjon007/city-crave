-- Create enum for user types
CREATE TYPE user_type AS ENUM ('customer', 'staff');

-- Create enum for order status
CREATE TYPE order_status AS ENUM ('pending', 'preparing', 'ready', 'in_delivery', 'delivered', 'cancelled');

-- Create enum for order type
CREATE TYPE order_type AS ENUM ('dine_in', 'takeaway', 'delivery');

-- Create branches table
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  address varchar(255) NOT NULL,
  phone varchar(20) NOT NULL,
  total_staff int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create menu_categories table
CREATE TABLE menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create menu table
CREATE TABLE menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  description text,
  photo_url varchar(255),
  category_id uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create profiles table for additional user data
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type user_type NOT NULL,
  name varchar(100) NOT NULL,
  phone varchar(20),
  email varchar(100),
  created_at timestamptz DEFAULT now()
);

-- Create staff table
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  salary decimal(10,2),
  working_hours int,
  hired_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  order_type order_type NOT NULL,
  status order_status DEFAULT 'pending',
  tax decimal(10,2) DEFAULT 0,
  tip decimal(10,2) DEFAULT 0,
  delivery_fee decimal(10,2) DEFAULT 0,
  total decimal(10,2) NOT NULL,
  delivery_address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ordered_items table
CREATE TABLE ordered_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES menu(id) ON DELETE SET NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  price_each decimal(10,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordered_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branches (public read)
CREATE POLICY "Anyone can view branches"
  ON branches FOR SELECT
  USING (true);

-- RLS Policies for menu_categories (public read)
CREATE POLICY "Anyone can view menu categories"
  ON menu_categories FOR SELECT
  USING (true);

-- RLS Policies for menu (public read)
CREATE POLICY "Anyone can view menu"
  ON menu FOR SELECT
  USING (true);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for staff
CREATE POLICY "Staff can view their own record"
  ON staff FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view other staff in same branch"
  ON staff FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.user_id = auth.uid()
      AND s.branch_id = staff.branch_id
    )
  );

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view orders for their branch"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.user_id = auth.uid()
      AND s.branch_id = orders.branch_id
    )
  );

CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pending orders"
  ON orders FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Staff can update orders for their branch"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.user_id = auth.uid()
      AND s.branch_id = orders.branch_id
    )
  );

-- RLS Policies for ordered_items
CREATE POLICY "Users can view items in their orders"
  ON ordered_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = ordered_items.order_id
      AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view items for their branch orders"
  ON ordered_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN staff s ON s.branch_id = o.branch_id
      WHERE o.id = ordered_items.order_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items to their own orders"
  ON ordered_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = ordered_items.order_id
      AND o.user_id = auth.uid()
    )
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, user_type, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update order updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for order updates
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_updated_at();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE ordered_items;

-- Insert 5 branches in the city
INSERT INTO branches (name, address, phone) VALUES
  ('Downtown Branch', '123 Main Street, City Center', '+1-555-0101'),
  ('Westside Branch', '456 West Avenue, West District', '+1-555-0102'),
  ('Eastside Branch', '789 East Boulevard, East District', '+1-555-0103'),
  ('North Branch', '321 North Road, North Quarter', '+1-555-0104'),
  ('South Branch', '654 South Street, South End', '+1-555-0105');

-- Insert menu categories
INSERT INTO menu_categories (name, description) VALUES
  ('Appetizers', 'Start your meal with our delicious starters'),
  ('Main Courses', 'Hearty and satisfying main dishes'),
  ('Desserts', 'Sweet treats to end your meal'),
  ('Beverages', 'Refreshing drinks and specialty beverages'),
  ('Salads', 'Fresh and healthy salad options');

-- Insert sample menu items
INSERT INTO menu (name, price, description, category_id, photo_url) 
SELECT 
  'Spring Rolls', 8.99, 'Crispy vegetable spring rolls with sweet chili sauce',
  id, 'https://images.unsplash.com/photo-1569744723309-b5a0c6e5a5e5'
FROM menu_categories WHERE name = 'Appetizers'
UNION ALL
SELECT 
  'Chicken Wings', 12.99, 'Buffalo style wings with blue cheese dip',
  id, 'https://images.unsplash.com/photo-1608039755401-742074f0548d'
FROM menu_categories WHERE name = 'Appetizers'
UNION ALL
SELECT 
  'Grilled Salmon', 24.99, 'Atlantic salmon with lemon butter sauce',
  id, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288'
FROM menu_categories WHERE name = 'Main Courses'
UNION ALL
SELECT 
  'Beef Burger', 15.99, 'Juicy beef patty with lettuce, tomato, and special sauce',
  id, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd'
FROM menu_categories WHERE name = 'Main Courses'
UNION ALL
SELECT 
  'Caesar Salad', 10.99, 'Fresh romaine lettuce with Caesar dressing and croutons',
  id, 'https://images.unsplash.com/photo-1546793665-c74683f339c1'
FROM menu_categories WHERE name = 'Salads'
UNION ALL
SELECT 
  'Chocolate Cake', 7.99, 'Rich chocolate layer cake with ganache',
  id, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587'
FROM menu_categories WHERE name = 'Desserts'
UNION ALL
SELECT 
  'Iced Coffee', 4.99, 'Cold brew coffee with ice',
  id, 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7'
FROM menu_categories WHERE name = 'Beverages';