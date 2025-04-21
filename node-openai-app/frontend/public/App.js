document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed');
    const form = document.getElementById('inputForm');
    const responseContainer = document.getElementById('responseContainer');
    const userInput = document.getElementById('userInput');
    const cvForm = document.getElementById('cvForm');
    const cvLinkButton = document.getElementById('cvLink');

    try {
        // Fetch the filename from the backend
        const response = await fetch('/cv_public/filename');
        const data = await response.json();

        if (data.filename && data.filename.endsWith('.pdf')) {
            // Set the action for the CV download form
            cvForm.action = `/cv_public/${data.filename}`;
            cvLinkButton.textContent = `Download Luke's CV`;
        } else {
            cvLinkButton.textContent = 'No valid CV available';
            cvLinkButton.disabled = true; // Disable the button if no CV is available
        }
    } catch (error) {
        console.error('Error fetching CV filename:', error);
        cvLinkButton.textContent = 'Error loading CV';
        cvLinkButton.disabled = true; // Disable the button in case of an error
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const userMessage = userInput.value;
        if (!userMessage.trim()) return;

        // Show the response container after the first query
        if (responseContainer.style.display === 'none') {
            responseContainer.style.display = 'block';
        }

        // Add user message to the chat
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user-message';
        userMessageDiv.textContent = userMessage;
        responseContainer.appendChild(userMessageDiv);

        try {
            const keyword = "Standard";
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input: userMessage, keyword }),
            });

            const data = await response.json();

            // Add response message with typing effect
            const responseMessageDiv = document.createElement('div');
            responseMessageDiv.className = 'message response-message';
            responseContainer.appendChild(responseMessageDiv);

            // Typing effect
            const text = data.response;
            let index = 0;

            const typingInterval = setInterval(() => {
                if (index < text.length) {
                    responseMessageDiv.textContent += text[index];
                    index++;
                } else {
                    clearInterval(typingInterval);
                }
            }, 1); // Adjust typing speed (50ms per character)

            // Scroll to the bottom of the chat
            responseContainer.scrollTop = responseContainer.scrollHeight;
        } catch (error) {
            console.error('Error fetching response from OpenAI:', error);
        }

        userInput.value = ''; // Clear the input field
    });
});