import { Play, BookOpen, Clock } from 'lucide-react'

export default function TutorialsPage() {
  const tutorials = [
    {
      category: 'Getting Started',
      items: [
        {
          title: 'Setting Up Your Business',
          duration: '5 min',
          description: 'Learn how to configure your business profile and initial settings.',
          url: '#'
        },
        {
          title: 'First Sale in POS',
          duration: '3 min',
          description: 'Walk through processing your first sale from product selection to checkout.',
          url: '#'
        },
      ]
    },
    {
      category: 'Point of Sale',
      items: [
        {
          title: 'Advanced Discounting',
          duration: '6 min',
          description: 'Master item-level and order-level discounts for flexible pricing.',
          url: '#'
        },
        {
          title: 'Split Payments',
          duration: '4 min',
          description: 'Accept cash and online payments in a single transaction.',
          url: '#'
        },
        {
          title: 'Backdated Sales',
          duration: '3 min',
          description: 'Record historical sales with accurate dates and times.',
          url: '#'
        },
      ]
    },
    {
      category: 'Inventory Management',
      items: [
        {
          title: 'Adding Products',
          duration: '5 min',
          description: 'Create new products with categories, suppliers, and pricing.',
          url: '#'
        },
        {
          title: 'Stock Restocking',
          duration: '6 min',
          description: 'Receive new stock and track inventory batches.',
          url: '#'
        },
        {
          title: 'Cost Price Management',
          duration: '4 min',
          description: 'Update cost prices and track profit margins accurately.',
          url: '#'
        },
      ]
    },
    {
      category: 'Reports & Analytics',
      items: [
        {
          title: 'Sales Reports',
          duration: '5 min',
          description: 'Generate and analyze sales data with date filtering and exports.',
          url: '#'
        },
        {
          title: 'Profit Analysis',
          duration: '6 min',
          description: 'Understand your margins and profitability per transaction.',
          url: '#'
        },
      ]
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">Tutorials</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">Learn how to use Vyapaar with our video tutorials and guides</p>
        </div>

      {/* Tutorial Categories */}
      <div className="space-y-8">
        {tutorials.map((category) => (
          <div key={category.category}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-600" />
              {category.category}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.items.map((tutorial, idx) => (
                <a
                  key={idx}
                  href={tutorial.url}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4 mb-3">
                    <div className="bg-primary-100 dark:bg-primary-900/30 rounded-lg p-3 group-hover:bg-primary-600 group-hover:text-white transition-all">
                      <Play className="w-5 h-5 text-primary-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {tutorial.title}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {tutorial.duration}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {tutorial.description}
                  </p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-8 text-white text-center">
        <h3 className="text-xl font-bold mb-2">Can't find what you need?</h3>
        <p className="mb-4 opacity-90">Check out our comprehensive documentation or contact support</p>
        <button className="bg-white text-primary-600 hover:bg-slate-100 px-6 py-2 rounded-lg font-medium transition-colors">
          Contact Support
        </button>
      </div>
      </div>
    </div>
  )
}
