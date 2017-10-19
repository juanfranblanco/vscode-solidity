import * as solc from 'solc';


process.on('message', function (sources) {
    try {
        const output = solc.compile({ sources });
        sendResult({ output });
    } catch (error) {
        sendResult({ error });
    }
});


function sendResult(result) {
    process.send(result);

    process.exit(result.error && 1 || 0);
}
