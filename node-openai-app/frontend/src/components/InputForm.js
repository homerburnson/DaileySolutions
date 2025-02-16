import React, { useState } from 'react';

const InputForm = () => {
    const [input, setInput] = useState('');
    const [response, setResponse] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: input }),
            });
            const data = await res.json();
            setResponse(data.response);
        } catch (error) {
            console.error('Error fetching response:', error);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter your query"
                    required
                />
                <button type="submit">Submit</button>
            </form>
            {response && <div><h3>Response:</h3><p>{response}</p></div>}
        </div>
    );
};

export default InputForm;