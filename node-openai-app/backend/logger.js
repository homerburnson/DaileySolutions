const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
const DailyRotateFile = require('winston-daily-rotate-file');

// Configure the logger
const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss UTC' }),
        printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/server-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '10d', // Keep logs for 10 days
            zippedArchive: true, // Compress old logs
        }),
        new transports.Console(), // Also log to the console
    ],
});

module.exports = logger;