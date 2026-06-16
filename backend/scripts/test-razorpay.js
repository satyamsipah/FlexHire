// Run from the backend/ directory: node scripts/test-razorpay.js
// Creates a ₹1 test order to confirm your Razorpay credentials are valid before Week 6.
import 'dotenv/config';
import Razorpay from 'razorpay';

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('Error: Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env first.');
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

// Amount is in paise (smallest unit). 100 paise = ₹1.
const order = await razorpay.orders.create({
  amount:  100,
  currency: 'INR',
  receipt:  `test_${Date.now()}`,
});

console.log('Razorpay credentials valid!');
console.log('Test order ID:', order.id);
console.log('Amount:', order.amount, 'paise =', order.amount / 100, 'INR');
