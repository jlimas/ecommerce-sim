import random

from faker import Faker

fake = Faker()


def generate_products(num_products=20):
    products = []
    sizes = ["XS", "S", "M", "L", "XL"]
    colors = ["Red", "Blue", "Green", "Black", "White", "Yellow", "Pink"]
    categories = ["Apparel", "Accessories", "Footwear"]

    for i in range(num_products):
        product = {
            "id": f"PRD_{i + 1}",
            "name": fake.bs().title() + " " + fake.word().capitalize(),
            "description": fake.catch_phrase(),
            "price": round(random.uniform(10.0, 200.0), 2),
            "attributes": {
                "size": random.choice(sizes),
                "color": random.choice(colors),
                "category": random.choice(categories),
            },
        }
        products.append(product)
    return products


# In-memory "database"
PRODUCTS = generate_products(25)
CARTS = {}  # { "user_id": [{"productId": "...", "quantity": 1}] }
