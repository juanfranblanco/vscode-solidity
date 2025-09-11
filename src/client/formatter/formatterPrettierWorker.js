const { parentPort } = require('worker_threads');

parentPort.on('message', async (task) => {
    try {
        // Dynamically import prettier
        const prettier = await import(task.prettierPath);

        // Resolve config
        const config = await prettier.resolveConfig(task.documentPath);
        if (config !== null) {
            await prettier.clearConfigCache();
        }

        // Merge user config with default options
        const options = { ...task.options, ...config, plugins: [task.pluginPath] };
        const formatted = await prettier.format(task.source, options);

        parentPort.postMessage({ success: true, formatted });
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
});