CREATE TABLE IF NOT EXISTS menu_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT NULL,
  description TEXT NULL,
  is_bestseller TINYINT(1) NOT NULL DEFAULT 0,
  is_chef_pick TINYINT(1) NOT NULL DEFAULT 0,
  is_dessert_week TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dining_showcase (
  showcase_id INT PRIMARY KEY,
  most_ordered_title VARCHAR(180) NOT NULL,
  most_ordered_subtitle VARCHAR(255) NOT NULL,
  chef_recommendation_title VARCHAR(180) NOT NULL,
  chef_recommendation_subtitle VARCHAR(255) NOT NULL,
  dessert_week_title VARCHAR(180) NOT NULL,
  dessert_week_subtitle VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO dining_showcase
  (showcase_id, most_ordered_title, most_ordered_subtitle, chef_recommendation_title, chef_recommendation_subtitle, dessert_week_title, dessert_week_subtitle)
VALUES
  (1, 'Butter Chicken Royale', '412 orders this month', 'Wagyu Tenderloin', 'Guests rate it 4.9/5', 'Belgian Chocolate Dome', 'Pairs with Ethiopian roast');

