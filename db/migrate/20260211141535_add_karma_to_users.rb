class AddKarmaToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :karma, :float, default: 0.0, null: false
  end
end
