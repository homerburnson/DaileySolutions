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
            cvLinkButton.textContent = `Download ${NAME}'s CV`;
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

        // Add user message to the chat
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user-message';
        if (document.body.classList.contains('dark-mode')) {
            userMessageDiv.classList.add('dark-mode'); // Apply dark mode styling
        }
        userMessageDiv.textContent = userMessage;
        responseContainer.appendChild(userMessageDiv);

        // Add "typing" message
        const typingMessageDiv = document.createElement('div');
        typingMessageDiv.className = 'message response-message';
        if (document.body.classList.contains('dark-mode')) {
            typingMessageDiv.classList.add('dark-mode'); // Apply dark mode styling
        }
        typingMessageDiv.textContent = `${NAME} is typing...`;
        responseContainer.appendChild(typingMessageDiv);

        try {
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input: userMessage }),
            });

            const data = await response.json();

            // Remove "typing" message
            typingMessageDiv.remove();

            // Add response message
            const responseMessageDiv = document.createElement('div');
            responseMessageDiv.className = 'message response-message';
            if (document.body.classList.contains('dark-mode')) {
                responseMessageDiv.classList.add('dark-mode'); // Apply dark mode styling
            }
            responseMessageDiv.textContent = data.response;
            responseContainer.appendChild(responseMessageDiv);

            // Scroll to the bottom of the chat
            responseContainer.scrollTop = responseContainer.scrollHeight;
        } catch (error) {
            console.error('Error fetching response:', error);

            // Remove "typing" message in case of an error
            typingMessageDiv.remove();
        }

        userInput.value = ''; // Clear the input field
    });
});