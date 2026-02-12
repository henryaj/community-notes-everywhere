FactoryBot.define do
  factory :note_status_change do
    association :note
    from_status { 0 }
    to_status { 1 }
    helpful_count_at_change { 3 }
    somewhat_count_at_change { 0 }
    not_helpful_count_at_change { 0 }
    trigger { "rating" }
  end
end
