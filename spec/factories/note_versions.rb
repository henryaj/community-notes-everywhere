FactoryBot.define do
  factory :note_version do
    association :note
    previous_body { "Previous version of the note body" }
  end
end
