import { Feedback } from '@/lib/session-store'

type Props = {
  feedback: Feedback
}

export default function FeedbackCard({ feedback }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-green-700 mb-2">Strength</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{feedback.strength}</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-amber-700 mb-2">Area to Develop</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{feedback.areaToDevelop}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-700 mb-2">Recommended Next Step</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{feedback.recommendedNextStep}</p>
      </div>
    </div>
  )
}
