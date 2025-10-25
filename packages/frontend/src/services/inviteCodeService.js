import { apiHelpers } from './api'

const inviteCodeService = {
  // Get payment configuration
  getPaymentConfig: async () => {
    return await apiHelpers.get('/api/invite-codes/payment-config')
  },

  // Purchase invite code with transaction hash
  purchaseInviteCode: async (txHash, email) => {
    return await apiHelpers.post('/api/invite-codes/purchase', {
      txHash,
      email
    })
  },

  // Check transaction status
  checkTransaction: async (txHash) => {
    return await apiHelpers.get(`/api/invite-codes/check-transaction/${txHash}`)
  },

  // Validate invite code
  validateCode: async (code) => {
    return await apiHelpers.get(`/api/invite-codes/validate/${code}`)
  }
}

export default inviteCodeService
