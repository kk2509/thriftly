CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);



CREATE TABLE cart (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE favorites (
  user_id TEXT,
  product_id INTEGER,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE users (
  google_id TEXT PRIMARY KEY,
  name TEXT
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN image_url TEXT;
INSERT INTO products (name, description, price, image_url, created_at)
VALUES 
  ('Vintage Denim Jacket', 'Classic blue denim with a retro vibe', 1299, '/assets/images/denim.jpg', NOW()),
  ('Boho Maxi Dress', 'Flowy dress with floral prints', 999, '/assets/images/maxi.jpg', NOW()),
  ('Graphic Oversized Tee', 'Cotton t-shirt with quirky graphic', 499, '/assets/images/tee.jpg', NOW()),
  ('Corduroy Shirt', 'Soft and stylish shirt in earthy tones', 799, '/assets/images/corduroy.jpg', NOW());


CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS cart (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, product_id)
);

ALTER TABLE cart
ADD CONSTRAINT unique_user_product
UNIQUE (user_id, product_id);
