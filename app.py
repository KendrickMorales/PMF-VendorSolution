from flask import Flask
from flask_cors import CORS
from routes import register_routes

app = Flask(__name__, static_folder='dist')
CORS(app)

# Register all routes
register_routes(app)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
