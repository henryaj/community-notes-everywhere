FactoryBot.define do
  factory :rating do
    association :user
    association :note
    helpful { true }
  end
end
