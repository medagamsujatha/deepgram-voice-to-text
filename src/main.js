const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

const recordBtn = document.getElementById('recordBtn');
const recordingStatus = document.getElementById('recordingStatus');
const transcriptBox = document.getElementById('transcript');
const balanceDisplay = document.getElementById('balance');
const errorDisplay = document.getElementById('error');

async function fetchBalance() {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/balance`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch balance');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    balanceDisplay.textContent = `$${data.balance.toFixed(2)}`;
  } catch (error) {
    console.error('Error fetching balance:', error);
    balanceDisplay.textContent = 'Error loading';
    console.log('Balance error:', error.message);
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      await transcribeAudio(audioBlob);

      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    updateUI();
    hideError();
  } catch (error) {
    console.error('Error starting recording:', error);
    showError('Failed to access microphone. Please grant permission.');
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    updateUI();
  }
}

async function transcribeAudio(audioBlob) {
  try {
    recordBtn.disabled = true;
    recordBtn.querySelector('.btn-text').textContent = 'Processing...';
    transcriptBox.textContent = 'Transcribing audio...';
    transcriptBox.classList.add('empty');

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Transcription failed');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.transcript) {
      transcriptBox.textContent = data.transcript;
      transcriptBox.classList.remove('empty');
    } else {
      transcriptBox.textContent = 'No speech detected. Please try again.';
      transcriptBox.classList.add('empty');
    }

    await fetchBalance();
  } catch (error) {
    console.error('Error transcribing audio:', error);
    showError(error.message || 'Failed to transcribe audio. Please try again.');
    transcriptBox.textContent = 'Click "Start Recording" to begin...';
    transcriptBox.classList.add('empty');
  } finally {
    recordBtn.disabled = false;
    updateUI();
  }
}

function updateUI() {
  if (isRecording) {
    recordBtn.querySelector('.btn-text').textContent = 'Stop Recording';
    recordBtn.querySelector('.btn-icon').textContent = '⏹️';
    recordingStatus.classList.remove('hidden');
  } else {
    recordBtn.querySelector('.btn-text').textContent = 'Start Recording';
    recordBtn.querySelector('.btn-icon').textContent = '🎤';
    recordingStatus.classList.add('hidden');
  }
}

function showError(message) {
  errorDisplay.textContent = message;
  errorDisplay.classList.remove('hidden');
}

function hideError() {
  errorDisplay.classList.add('hidden');
}

recordBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

fetchBalance();
