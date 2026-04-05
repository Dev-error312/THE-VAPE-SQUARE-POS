import { Mail, MessageSquare, FileText, AlertCircle } from 'lucide-react'

export default function HelpSupportPage() {
  const faqs = [
    {
      question: 'How do I process a sale?',
      answer: 'Go to Point of Sale, add items to cart, select payment method, and complete checkout. The invoice will be printed automatically.'
    },
    {
      question: 'How do I manage inventory?',
      answer: 'Visit Inventory page to view products, add new items, or edit existing products. Use Restock section to update stock levels and costs.'
    },
    {
      question: 'How do I view sales reports?',
      answer: 'Go to Reports page to see sales transactions, search by date, and export data. Admins can also view detailed profit analysis.'
    },
    {
      question: 'How do I manage employees?',
      answer: 'Admins can add employees in the Employees section and assign roles (Admin or Cashier). Each user gets their own login.'
    },
    {
      question: 'How do I reconcile my account?',
      answer: 'Use the Accounting page to track cash collections, expenses, and generate financial reports.'
    },
    {
      question: 'Can I undo a deleted transaction?',
      answer: 'Deleted transactions are permanent and cannot be recovered. Please be careful when deleting.'
    },
  ]

  const contacts = [
    {
      icon: Mail,
      title: 'Email Support',
      value: 'support@vyapaar.com',
      description: 'Email us for detailed assistance'
    },
    {
      icon: MessageSquare,
      title: 'Live Chat',
      value: 'Available 9 AM - 6 PM',
      description: 'Real-time support on our website'
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">Help & Support</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">Find answers to common questions and get support</p>
        </div>

      {/* Contact Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact) => {
          const Icon = contact.icon
          return (
            <div key={contact.title} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary-100 dark:bg-primary-900/30 rounded-lg p-3">
                  <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{contact.title}</h3>
                  <p className="text-sm text-primary-600 dark:text-primary-400 font-mono mb-1">{contact.value}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{contact.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Frequently Asked Questions */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" />
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <details key={idx} className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 cursor-pointer">
              <summary className="flex items-center justify-between font-medium text-slate-900 dark:text-white select-none">
                <span>{faq.question}</span>
                <span className="transform group-open:rotate-180 transition-transform text-slate-500">▼</span>
              </summary>
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Need detailed documentation?</h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              Visit our comprehensive documentation portal for in-depth guides and tutorials.
            </p>
            <a href="#" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
              View Documentation →
            </a>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
