class NoteStatusChange < ApplicationRecord
  belongs_to :note

  def from_status_name
    Note.statuses.key(from_status)
  end

  def to_status_name
    Note.statuses.key(to_status)
  end
end
