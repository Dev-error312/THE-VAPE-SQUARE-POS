import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Loader, Trash2, Lock } from 'lucide-react'
import { updatesApi, type Update } from '../../lib/updatesApi'
import { useAuthStore } from '../../store/authStore'

const ADMIN_EMAIL = 'suyogadhiakri@gmail.com'

export function UpdatesAdminPage() {
  const user = useAuthStore((state) => state.user)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState<string>('1.0.0')
  const [nextVersion, setNextVersion] = useState<string>('1.0.0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [updates, setUpdates] = useState<Update[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Check authorization
  const isAuthorized = user?.email === ADMIN_EMAIL

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            This page is restricted to authorized administrators only.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Current email: <span className="font-semibold">{user?.email || 'Not authenticated'}</span>
          </p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadNextVersion()
    loadUpdates()
  }, [])

  const loadUpdates = async () => {
    try {
      const data = await updatesApi.getAll()
      setUpdates(data)
    } catch (err) {
      console.error('Failed to load updates:', err)
    }
  }

  const loadNextVersion = async () => {
    try {
      const autoVersion = await updatesApi.getNextVersion()
      setNextVersion(autoVersion)
      setVersion(autoVersion)
    } catch (err) {
      console.error('Failed to load next version:', err)
      setNextVersion('1.0.0')
      setVersion('1.0.0')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !description.trim()) {
      setError('Please fill in both title and description')
      return
    }

    if (!version.trim()) {
      setError('Please enter a version number')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const now = new Date().toISOString()
      await updatesApi.create({
        title: title.trim(),
        description: description.trim(),
        version: version.trim(),
        release_date: now,
        is_published: true,
      })

      // Success! Reset form and reload next version
      setTitle('')
      setDescription('')
      setSuccess(true)
      await loadNextVersion()
      await loadUpdates()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish update')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (updateId: string) => {
    try {
      setDeletingId(updateId)
      await updatesApi.delete(updateId)
      setUpdates(updates.filter(u => u.id !== updateId))
      setDeleteConfirm(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete update')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Publish App Update
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Push a new update that all users will see
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          {/* Version Field */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
              Version Number
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g., 1.0.0"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={loading}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Auto-suggested: <span className="font-semibold text-blue-600 dark:text-blue-400">{nextVersion}</span> • Edit for major releases (e.g., 2.0.0)
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-300">
                Update published successfully! All users will see it.
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Update Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., New Checkout Feature, Bug Fix"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Brief title of what's new in this update
              </p>
            </div>

            {/* Description Field */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's new, fixed, or improved..."
                rows={6}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                disabled={loading}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Detailed description of the changes in this update
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader className="w-5 h-5 animate-spin" />}
              {loading ? 'Publishing...' : 'Publish Update'}
            </button>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
            About App Updates
          </h3>
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <li>✓ Published updates are immediately visible to all users</li>
            <li>✓ Version auto-increments (e.g., 1.0.0 → 1.0.1) but you can customize it</li>
            <li>✓ Use major versions for big updates (e.g., 2.0.0) and patch versions for small fixes</li>
            <li>✓ Users are notified when new updates are available</li>
            <li>✓ All updates are permanent and organized chronologically</li>
          </ul>
        </div>

        {/* All Updates List */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">All Updates</h2>
          {updates.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No updates published yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((update) => (
                <div key={update.id} className="bg-white dark:bg-slate-800 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold">
                        v{update.version}
                      </span>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {update.title}
                      </h4>
                      {update.type && (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-semibold capitalize">
                          {update.type}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{update.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {deleteConfirm === update.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(update.id)}
                          disabled={deletingId === update.id}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-sm font-medium rounded transition-colors"
                        >
                          {deletingId === update.id ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1 bg-slate-300 hover:bg-slate-400 text-slate-800 text-sm font-medium rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(update.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete update"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdatesAdminPage

