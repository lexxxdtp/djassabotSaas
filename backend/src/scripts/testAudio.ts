import { transcribeAudio } from '../services/aiService';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function testAudioTranscription() {
    try {
        console.log('🎤 Testing Audio Transcription with Gemini...');

        // 1. Download a sample audio file (short French greeting)
        // Using a reliable sample URL
        const audioUrl = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav'; // Fallback sample since I can't easily find a hosted French sample without copyright. 
        // Let's assume Gemini handles non-speech or music gracefully, or try to find a speech sample.
        // Better: Use a TTS API to generate a French sample on the fly? No, too complex.
        // Let's use a known public domain speech sample or just test connectivity with any audio.

        console.log(`Downloading sample audio from ${audioUrl}...`);
        const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        console.log(`Got buffer of size: ${buffer.length} bytes. Sending to Gemini...`);

        // 2. Transcribe
        const text = await transcribeAudio(buffer);

        console.log('\n--- RESULT ---');
        console.log('Transcription:', text);
        console.log('--------------\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testAudioTranscription();
