document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('inputForm');
    const responseContainer = document.getElementById('responseContainer');
    const responseText = document.getElementById('responseText');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userInput = document.getElementById('userInput').value;

        try {
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input: userInput }),
            });
            const data = await response.json();
            responseText.textContent = data.response;
            responseContainer.style.display = 'block';
        } catch (error) {
            console.error('Error fetching response from OpenAI:', error);
        }
    });
});

export default App;