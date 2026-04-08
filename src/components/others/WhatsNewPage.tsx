import { useEffect, useState, useCallback } from 'react'
import { updatesApi, type Update } from '../../lib/updatesApi'
import { formatDate } from '../../utils'
import { Calendar, Sparkles, ChevronDown, X } from 'lucide-react'
import LoadingSpinner from '../shared/LoadingSpinner'

/**
 * What's New Page - Universal App Updates
 * Displays updates as expandable accordion items.
 * Latest update is expanded by default, others are collapsed.
 * Like iOS/Android/Windows app updates.
 */
export default function WhatsNewPage() {
  const [updates, setUpdates] = useState<Update[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setHasUnseenUpdates] = useState(false)
  const [showUnseenModal, setShowUnseenModal] = useState(false)

  const loadUpdates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch updates and unseen status in parallel for faster loading
      const [data, hasUnseen] = await Promise.all([
        updatesApi.getAll(),
        updatesApi.hasUnseenUpdates(),
      ])

      setUpdates(data)
      if (data.length > 0) {
        setExpandedId(data[0].id) // Expand latest by default
      }

      setHasUnseenUpdates(hasUnseen)
      if (hasUnseen) {
        setShowUnseenModal(true)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load updates'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUpdates()
  }, [loadUpdates])

  const handleViewedUpdates = async () => {
    setShowUnseenModal(false) // Close modal immediately
    try {
      await updatesApi.markAsSeen()
      setHasUnseenUpdates(false)
    } catch (err) {
      console.warn('Failed to mark updates as seen:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="Loading updates..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
            <button
              onClick={() => loadUpdates()}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">What's New</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {updates.length === 0
              ? 'Stay tuned for updates'
              : `${updates.length} update${updates.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Updates Accordion */}
        {updates.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400 text-lg">No updates yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
              Check back soon for new features and improvements
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {updates.map((update, index) => (
              <div key={update.id} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                {/* Accordion Header */}
                <button
                  onClick={() => setExpandedId(expandedId === update.id ? null : update.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold whitespace-nowrap">
                      v{update.version}
                    </span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      {update.title}
                    </span>
                    {index === 0 && (
                      <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-semibold animate-pulse whitespace-nowrap">
                        Latest
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${
                      expandedId === update.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Accordion Content */}
                {expandedId === update.id && (
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    {/* Date */}
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                      <Calendar className="w-4 h-4" />
                      {formatDate(update.release_date)}
                    </div>

                    {/* Type Badge */}
                    {update.type && (
                      <div>
                        <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-semibold capitalize">
                          {update.type}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">
                      {update.description}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        {updates.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ✨ You're always on the latest version – new features roll out automatically!
            </p>
          </div>
        )}
      </div>

      {/* Modal: New Updates Alert */}
      {showUnseenModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200 ease-out">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-center relative">
              <button
                onClick={() => setShowUnseenModal(false)}
                className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-lg transition-colors duration-150"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex justify-center mb-3">
                <div className="bg-white/20 p-3 rounded-full">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">New Updates Available!</h2>
              <p className="text-blue-100">Check out what's new</p>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-4">
              {updates.slice(0, 2).map((update) => (
                <div key={update.id} className="pb-4 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-slate-900 dark:text-white">v{update.version}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(update.release_date)}</span>
                  </div>
                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">{update.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{update.description}</p>
                </div>
              ))}

              {updates.length > 2 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  +{updates.length - 2} more update{updates.length - 2 !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleViewedUpdates}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-150"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
