import React, { useState } from 'react';
import InputForm from './components/InputForm';
import './styles/App.css';

function App() {
    const [response, setResponse] = useState('');

    const handleResponse = (data) => {
        setResponse(data);
    };

    return (
        <div className="App">
            <h1>OpenAI Query Interface</h1>
            <InputForm onResponse={handleResponse} />
            {response && (
                <div className="response">
                    <h2>Response from OpenAI:</h2>
                    <p>{response}</p>
                </div>
            )}
        </div>
    );
}

export default App;