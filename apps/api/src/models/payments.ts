import { Schema, model } from 'mongoose';

const { ObjectId } = Schema.Types;

/* ------------------------------------------------------ PaymentMethod */
/**
 * A card the student saved with the payment gateway. Only the gateway's token and display details
 * are stored — never the card number or CVV (the gateway holds those, as RBI tokenisation requires).
 */
const paymentMethodSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    gateway: { type: String, enum: ['test', 'razorpay'], required: true },
    token: { type: String, required: true, select: false }, // gateway token id (e.g. Razorpay token_…)
    customerId: { type: String, select: false }, // gateway customer id the token belongs to
    network: { type: String, enum: ['visa', 'mastercard', 'rupay', 'amex', 'other'], default: 'other' },
    cardType: { type: String, enum: ['credit', 'debit', 'prepaid'], default: 'debit' },
    issuer: { type: String, maxlength: 60 },
    last4: { type: String, required: true, match: /^\d{4}$/ },
    expMonth: { type: Number, min: 1, max: 12, required: true },
    expYear: { type: Number, min: 2000, max: 2100, required: true },
    holder: { type: String, maxlength: 80 },
    nickname: { type: String, maxlength: 40 },
    finish: { type: String, enum: ['metal', 'black', 'glass', 'color'], default: 'metal' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const PaymentMethod = model('PaymentMethod', paymentMethodSchema);

/* ------------------------------------------------------------ Payment */
/** One attempt to pay for a session. Amounts are integers in paise. */
const paymentSchema = new Schema(
  {
    payer: { type: ObjectId, ref: 'User', required: true, index: true },
    student: { type: ObjectId, ref: 'StudentProfile', required: true },
    alumnus: { type: ObjectId, ref: 'Alumnus', required: true, index: true },
    mentorship: { type: ObjectId, ref: 'Mentorship', required: true },
    session: { type: ObjectId, ref: 'Session', required: true, index: true },
    amount: { type: Number, required: true, min: 100 },
    platformFee: { type: Number, required: true, min: 0 },
    mentorShare: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    gateway: { type: String, enum: ['test', 'razorpay'], required: true },
    orderId: { type: String, required: true, unique: true },
    gatewayPaymentId: { type: String, sparse: true, unique: true },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created', index: true },
    method: {
      kind: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'other'] },
      network: String,
      last4: String,
      vpa: String, // masked UPI id, e.g. aa***@okhdfc
      savedMethod: { type: ObjectId, ref: 'PaymentMethod' },
    },
    receiptNo: { type: String, required: true, unique: true },
    paidAt: Date,
    failureReason: String,
    refund: {
      amount: Number,
      status: { type: String, enum: ['pending', 'processed', 'failed'] },
      gatewayRefundId: String,
      reason: String,
      at: Date,
    },
  },
  { timestamps: true },
);
paymentSchema.index({ status: 1, createdAt: -1 });
export const Payment = model('Payment', paymentSchema);
