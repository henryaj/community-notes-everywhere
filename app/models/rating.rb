class Rating < ApplicationRecord
  belongs_to :user
  belongs_to :note

  validates :user_id, uniqueness: { scope: :note_id, message: "has already rated this note" }

  after_save :update_note_counters
  after_destroy :update_note_counters

  private

  def update_note_counters
    note.update!(
      helpful_count: note.ratings.where(helpful: true).count,
      not_helpful_count: note.ratings.where(helpful: false).count
    )
    note.update_status!
  end
end
