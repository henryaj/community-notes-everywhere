FactoryBot.define do
  factory :report do
    association :user
    association :note
    reason { :spam }
  end
end
