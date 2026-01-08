export const generateWavePaymentLink = async (amount: number, orderId: string) => {
    // In reality, we would call Wave API here.
    // For now, we simulate a link.
    const baseUrl = "https://pay.wave.com/m/mock_merchant";
    return `${baseUrl}?amount=${amount}&ref=${orderId}`;
};

export const checkPaymentStatus = async (orderId: string) => {
    // Mock check
    return "PAID"; // Simulate instant success
};
