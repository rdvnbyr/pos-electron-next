# POS Terminal Mock Setup Script
# _mocks/pos.sh
# This script sets up a mock environment for POS terminal testing.
# directory: _mocks/pos.js

echo "Pos terminal mock setup script executed."
node _mocks/pos.js --host 0.0.0.0 --port 20007
echo "POS terminal mock server is running on port 20007."
