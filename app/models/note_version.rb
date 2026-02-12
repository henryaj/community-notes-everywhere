class NoteVersion < ApplicationRecord
  belongs_to :note
  validates :previous_body, presence: true
end
