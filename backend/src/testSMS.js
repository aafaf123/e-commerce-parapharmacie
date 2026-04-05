import { sendSMS } from "./services/smsService.js";

const testNumber = "+212679104946"
const message ="Hello! This is a test message from your project."
sendSMS(testNumber, message);