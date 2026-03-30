import { MathText } from '@/components/MathText'
import { Feedback } from '@/lib/session-store'

type Props = {
  feedback: Feedback
}

export default function FeedbackCard({ feedback }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
        <h3 className="text-sm font-semibold text-primary mb-2">Strength</h3>
        <MathText className="text-sm text-foreground">{feedback.strength}</MathText>
      </div>

      <div className="rounded-2xl border border-secondary/25 bg-secondary/5 p-5">
        <h3 className="text-sm font-semibold text-secondary mb-2">Area to Develop</h3>
        <MathText className="text-sm text-foreground">{feedback.areaToDevelop}</MathText>
      </div>

      <div className="rounded-2xl border border-accent/25 bg-accent/5 p-5">
        <h3 className="text-sm font-semibold text-accent mb-2">Recommended Next Step</h3>
        <MathText className="text-sm text-foreground">{feedback.recommendedNextStep}</MathText>
      </div>
    </div>
  )
}
