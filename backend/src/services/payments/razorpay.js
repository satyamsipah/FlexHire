import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Creates a Razorpay Order so the frontend can open Checkout.
// amount is in paise (₹1 = 100 paise).
export async function createOrder(amountPaise, milestoneId, projectId) {
  return razorpay.orders.create({
    amount:   amountPaise,
    currency: 'INR',
    receipt:  milestoneId.toString(),
    notes: {
      projectId:   projectId.toString(),
      milestoneId: milestoneId.toString(),
    },
  });
}

// Refunds a captured payment fully (used by resolveDispute + autoRefund).
export async function refundPayment(razorpayPaymentId, amountPaise) {
  return razorpay.payments.refund(razorpayPaymentId, { amount: amountPaise });
}

// TODO (Week 8): replace with real razorpay.payouts.create() once Razorpay X is activated.
// Requires freelancer.razorpayContactId + razorpayFundAccountId to be set.
export async function mockPayout(freelancerId, amountPaise, milestoneId) {
  console.log(
    `[MOCK PAYOUT] freelancer=${freelancerId} amount=${amountPaise / 100}₹ milestone=${milestoneId}`
  );
  return `payout_mock_${Date.now()}`;
}
