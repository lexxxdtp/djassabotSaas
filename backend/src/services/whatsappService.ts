import axios from 'axios';

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

export const sendTextMessage = async (to: string, body: string) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: to,
                text: { body: body },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                },
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('Error sending message:', error.response ? error.response.data : error.message);
        throw error;
    }
}


export const getMediaUrl = async (mediaId: string) => {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/v21.0/${mediaId}`,
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                },
            }
        );
        return response.data.url;
    } catch (error: any) {
        console.error('Error getting media URL:', error.response ? error.response.data : error.message);
        throw error;
    }
};
