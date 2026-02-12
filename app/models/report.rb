class Report < ApplicationRecord
  belongs_to :user
  belongs_to :note, counter_cache: true

  enum :reason, { spam: 0, harassment: 1, misleading: 2, other: 3 }

  validates :user_id, uniqueness: { scope: :note_id, message: "has already reported this note" }
  validates :reason, presence: true
end
