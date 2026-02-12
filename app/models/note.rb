class Note < ApplicationRecord
  belongs_to :author, class_name: "User"
  belongs_to :page
  has_many :ratings, dependent: :destroy
  has_many :reports, dependent: :destroy
  has_many :note_versions, dependent: :destroy
  has_many :note_status_changes, dependent: :destroy

  enum :status, { pending: 0, helpful: 1, not_helpful: 2 }

  validates :body, presence: true
  validates :selected_text, presence: true

  def hidden?
    reports_count >= 3
  end

  def transparency_data
    positive_count = helpful_count + somewhat_count
    total = positive_count + not_helpful_count
    {
      positive_count: positive_count,
      total_ratings: total,
      min_positive_needed: 3,
      ratio_required: 2,
      meets_positive_threshold: positive_count >= 3,
      meets_helpful_ratio: not_helpful_count.zero? || positive_count > not_helpful_count * 2,
      meets_not_helpful_threshold: not_helpful_count >= 3,
      meets_not_helpful_ratio: positive_count.zero? || not_helpful_count > positive_count * 2,
      positive_progress: [ positive_count, 3 ].min,
      negative_progress: [ not_helpful_count, 3 ].min
    }
  end

  def record_status_change!(from, to, trigger)
    note_status_changes.create!(
      from_status: Note.statuses[from],
      to_status: Note.statuses[to],
      helpful_count_at_change: helpful_count,
      somewhat_count_at_change: somewhat_count,
      not_helpful_count_at_change: not_helpful_count,
      trigger: trigger
    )
  end

  def update_status!
    positive_count = helpful_count + somewhat_count
    if positive_count >= 3 && positive_count > not_helpful_count * 2
      self.status = :helpful
    elsif not_helpful_count >= 3 && not_helpful_count > positive_count * 2
      self.status = :not_helpful
    end

    if status_changed?
      previous_status = status_was
      record_status_change!(previous_status, status, "rating")
      save!
      ratings.includes(:user).find_each do |r|
        r.user.recalculate_reputation!
        r.user.recalculate_rating_impact!
      end
    end
  end
end
