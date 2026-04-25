import type { Question } from '../../types/api'

export interface AnswerDraft {
  question_id: number
  text_answer: string | null
  boolean_answer: boolean | null
  selected_choice_ids: number[]
}

interface QuestionRendererProps {
  question: Question
  answer: AnswerDraft
  onChange: (next: AnswerDraft) => void
}

export function QuestionRenderer({ question, answer, onChange }: QuestionRendererProps) {
  if (question.type === 'short_text') {
    return (
      <textarea
        className="textarea textarea-bordered min-h-48 w-full"
        placeholder="Saisissez votre reponse ici..."
        value={answer.text_answer ?? ''}
        onChange={(event) =>
          onChange({
            ...answer,
            text_answer: event.target.value,
          })
        }
      />
    )
  }

  if (question.type === 'true_false') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[true, false].map((option) => (
          <button
            key={String(option)}
            type="button"
            className={`rounded-3xl border p-5 text-left transition ${
              answer.boolean_answer === option
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white hover:border-slate-400'
            }`}
            onClick={() =>
              onChange({
                ...answer,
                boolean_answer: option,
              })
            }
          >
            <p className="text-lg font-semibold">{option ? 'Vrai' : 'Faux'}</p>
            <p className={`mt-2 text-sm ${answer.boolean_answer === option ? 'text-slate-200' : 'text-slate-500'}`}>
              Selectionner cette proposition
            </p>
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'single_choice') {
    return (
      <div className="space-y-3">
        {question.choices.map((choice) => (
          <label key={choice.id} className="label cursor-pointer justify-start gap-4 rounded-3xl border border-slate-200 px-5 py-4">
            <input
              type="radio"
              className="radio radio-sm"
              checked={answer.selected_choice_ids.includes(choice.id)}
              onChange={() =>
                onChange({
                  ...answer,
                  selected_choice_ids: [choice.id],
                })
              }
            />
            <span className="label-text text-base text-slate-700">{choice.label}</span>
          </label>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {question.choices.map((choice) => (
        <label key={choice.id} className="label cursor-pointer justify-start gap-4 rounded-3xl border border-slate-200 px-5 py-4">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={answer.selected_choice_ids.includes(choice.id)}
            onChange={(event) =>
              onChange({
                ...answer,
                selected_choice_ids: event.target.checked
                  ? [...answer.selected_choice_ids, choice.id]
                  : answer.selected_choice_ids.filter((choiceId) => choiceId !== choice.id),
              })
            }
          />
          <span className="label-text text-base text-slate-700">{choice.label}</span>
        </label>
      ))}
    </div>
  )
}
