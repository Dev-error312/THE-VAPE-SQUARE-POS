/**
 * Centralized logging utility for the application.
 * Provides consistent error, warning, and info logging.
 * In production, can be extended to send logs to external services.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  stack?: string
}

class Logger {
  private isDevelopment = import.meta.env.DEV
  private logHistory: LogEntry[] = []
  private maxHistorySize = 100

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry)
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift()
    }
  }

  error(message: string, context?: Record<string, any>, error?: unknown): void {
    const formatted = this.formatMessage('error', message, context)
    
    if (error instanceof Error) {
      console.error(formatted, error)
      this.addToHistory({
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        context,
        stack: error.stack,
      })
    } else {
      console.error(formatted)
      this.addToHistory({
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        context,
      })
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    const formatted = this.formatMessage('warn', message, context)
    console.warn(formatted)
    this.addToHistory({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
    })
  }

  info(message: string, context?: Record<string, any>): void {
    const formatted = this.formatMessage('info', message, context)
    if (this.isDevelopment) {
      console.log(formatted)
    }
    this.addToHistory({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    })
  }

  debug(message: string, context?: Record<string, any>): void {
    if (!this.isDevelopment) return
    const formatted = this.formatMessage('debug', message, context)
    console.debug(formatted)
  }

  /**
   * Get recent log entries for debugging/analytics
   */
  getHistory(level?: LogLevel, limit: number = 20): LogEntry[] {
    const filtered = level
      ? this.logHistory.filter(l => l.level === level)
      : this.logHistory
    return filtered.slice(-limit)
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = []
  }
}

export const logger = new Logger()
