class Rating < ApplicationRecord
  belongs_to :user
  belongs_to :note

  enum :helpfulness, { yes: 0, somewhat: 1, no: 2 }

  validates :user_id, uniqueness: { scope: :note_id, message: "has already rated this note" }
  validates :helpfulness, presence: true

  after_save :update_note_counters
  after_destroy :update_note_counters

  private

  def update_note_counters
    note.update!(
      helpful_count: note.ratings.yes.count,
      somewhat_count: note.ratings.somewhat.count,
      not_helpful_count: note.ratings.no.count
    )
    note.update_status!
    note.author.recalculate_karma!
  end
end
